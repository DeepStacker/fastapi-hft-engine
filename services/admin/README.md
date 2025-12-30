# Admin Service

Administrative API for system management.

## Features
- Service health monitoring
- Configuration management
- Trader/instrument management
- Kafka topic management
- Backup and restore

## Authentication
JWT-based authentication with username/password.

## Environment Variables
```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
SECRET_KEY=your_secret_key
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/stockify
```

## Running
```bash
docker compose up admin-service
# or
uvicorn services.admin.main:app --port 8001
```

## API Endpoints
- `POST /auth/login` - Login
- `GET /services` - List services
- `GET /config` - Get configuration
- `GET /instruments` - List instruments
