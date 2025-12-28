# Pydantic models for Admin API
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID
from enum import Enum

# System Models
class SystemStats(BaseModel):
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    active_connections: int
    cache_hit_rate: float
    uptime_seconds: int

# Log Models
class LogEntry(BaseModel):
    id: int
    timestamp: datetime
    level: str
    service: str
    message: str
    metadata: Optional[Dict[str, Any]]

# Alert Models
class AlertRule(BaseModel):
    id: Optional[int] = None
    name: str
    condition: str
    threshold: float
    severity: str  # critical, warning, info
    enabled: bool
    notification_channels: List[str]

class AlertRuleCreate(BaseModel):
    name: str
    condition: str
    threshold: float
    severity: str
    enabled: bool = True
    notification_channels: List[str]

class AlertRuleUpdate(BaseModel):
    name: Optional[str] = None
    condition: Optional[str] = None
    threshold: Optional[float] = None
    severity: Optional[str] = None
    enabled: Optional[bool] = None
    notification_channels: Optional[List[str]] = None

# API Analytics Models
class APIMetrics(BaseModel):
    endpoint: str
    total_requests: int
    avg_latency_ms: float
    error_rate: float
    last_hour_requests: int

# Service Models
class ServiceStatus(BaseModel):
    name: str
    status: str  # running, stopped, error
    uptime: int
    cpu_percent: float
    memory_mb: int
    restart_count: int

# Configuration Models
class ConfigItem(BaseModel):
    key: str
    value: str
    description: str
    category: str
    data_type: str = "string"
    requires_restart: bool

class ConfigUpdate(BaseModel):
    value: str

# User Models
class UserInfo(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    is_admin: bool
    created_at: datetime
    last_login: Optional[datetime]

# Kafka Models
class KafkaTopic(BaseModel):
    name: str
    partitions: int
    replication_factor: int
    config: Dict[str, str]

class KafkaConsumerGroup(BaseModel):
    group_id: str
    topics: List[str]
    total_lag: int
    members: int

class KafkaTopicCreate(BaseModel):
    name: str
    partitions: int = 3
    replication_factor: int = 1

# Instrument Models
class Instrument(BaseModel):
    id: int
    symbol_id: int
    symbol: str
    segment_id: int  # 0=Indices, 1=Stocks, 5=Commodities
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class InstrumentCreate(BaseModel):
    symbol_id: int
    symbol: str
    segment_id: int
    is_active: bool = True

class InstrumentUpdate(BaseModel):
    symbol_id: Optional[int] = None
    symbol: Optional[str] = None
    segment_id: Optional[int] = None
    is_active: Optional[bool] = None


# Database Models
class TableInfo(BaseModel):
    name: str
    schema: str
    row_count: int
    size_mb: float
    indexes: List[str]

class DatabaseStats(BaseModel):
    total_tables: int
    total_size_mb: float
    active_connections: int
    max_connections: int
    cache_hit_ratio: float

# Backup Models
class BackupInfo(BaseModel):
    id: str
    filename: str
    size_mb: float
    created_at: datetime
    status: str  # completed, failed, in_progress

class BackupCreate(BaseModel):
    description: Optional[str] = None

# WebSocket Models
class WebSocketConnection(BaseModel):
    id: str
    user: str
    symbol_id: str
    connected_at: datetime
    messages_sent: int
    remote_addr: str

# App User (Trader) Models
class UserRole(str, Enum):
    USER = "user"
    PREMIUM = "premium"
    ADMIN = "admin"

class AppUser(BaseModel):
    id: UUID
    firebase_uid: str
    email: str
    username: str
    full_name: Optional[str]
    is_active: bool
    role: UserRole
    created_at: datetime
    last_login: Optional[datetime]
    
    class Config:
        from_attributes = True

class AppUserUpdate(BaseModel):
    is_active: Optional[bool] = None
    role: Optional[UserRole] = None
    full_name: Optional[str] = None

class AppUserCreate(BaseModel):
    email: str
    username: str
    firebase_uid: str
    full_name: Optional[str] = None
    role: UserRole = UserRole.USER

class AuditLog(BaseModel):
    id: UUID
    timestamp: datetime
    actor_id: Optional[UUID]
    action: str
    resource_type: str
    resource_id: Optional[str]
    details: Optional[Dict[str, Any]]
    ip_address: Optional[str]
    status: str

    class Config:
        from_attributes = True

