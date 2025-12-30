"""
Admin Database Models - Persistent Storage for Dashboard

Contains ONLY admin-specific models that don't exist in core/database/models.py.
For AlertRuleDB and SystemConfigDB, use core.database.models instead.
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database.db import Base

# NOTE: AlertRuleDB is defined in core/database/models.py - import from there
# NOTE: SystemConfigDB is defined in core/database/models.py - import from there


class AlertHistoryDB(Base):
    """Alert trigger history - links to AlertRuleDB from models.py"""
    __tablename__ = "alert_history"
    
    id = Column(Integer, primary_key=True, index=True)
    alert_rule_id = Column(Integer, ForeignKey('alert_rules.id', ondelete='CASCADE'))
    
    triggered_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    metric_value = Column(Float, nullable=False)
    threshold_value = Column(Float, nullable=False)
    
    # Notification status
    notification_sent = Column(Boolean, default=False)
    notification_channels = Column(JSON, nullable=True)
    notification_error = Column(Text, nullable=True)
    
    # Resolution
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<AlertHistory(alert_id={self.alert_rule_id}, triggered={self.triggered_at})>"


class BackupLogDB(Base):
    """Backup history and status"""
    __tablename__ = "backup_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Backup info
    backup_type = Column(String(20), nullable=False)  # full, incremental, database, config
    file_path = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    
    # Status
    status = Column(String(20), nullable=False, index=True)  # success, failed, in_progress
    error_message = Column(Text, nullable=True)
    
    # Timing
    started_at = Column(DateTime, nullable=False, index=True)
    completed_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    
    # Metadata
    created_by = Column(Integer, ForeignKey('users.id'))
    is_automated = Column(Boolean, default=False)
    
    def __repr__(self):
        return f"<BackupLog(type={self.backup_type}, status={self.status})>"


class PerformanceBenchmarkDB(Base):
    """Performance benchmark results"""
    __tablename__ = "performance_benchmarks"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Benchmark info
    benchmark_name = Column(String(100), nullable=False)
    endpoint = Column(String(200), nullable=True)
    
    # Results
    requests_per_second = Column(Float, nullable=False)
    avg_latency_ms = Column(Float, nullable=False)
    p50_latency_ms = Column(Float, nullable=False)
    p95_latency_ms = Column(Float, nullable=False)
    p99_latency_ms = Column(Float, nullable=False)
    
    error_count = Column(Integer, default=0)
    total_requests = Column(Integer, nullable=False)
    
    # System state during benchmark
    cpu_percent = Column(Float, nullable=True)
    memory_percent = Column(Float, nullable=True)
    active_connections = Column(Integer, nullable=True)
    
    # Metadata
    ran_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    duration_seconds = Column(Integer, nullable=False)
    
    def __repr__(self):
        return f"<Benchmark(name={self.benchmark_name}, rps={self.requests_per_second})>"


class ScheduledTaskDB(Base):
    """Scheduled/cron tasks"""
    __tablename__ = "scheduled_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Task info
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    task_type = Column(String(50), nullable=False)  # backup, cleanup, report, custom
    
    # Schedule (cron format)
    schedule = Column(String(100), nullable=False)  # "0 2 * * *" for 2am daily
    
    # Configuration
    config = Column(JSON, nullable=True)
    
    # Status
    enabled = Column(Boolean, default=True)
    last_run = Column(DateTime, nullable=True)
    next_run = Column(DateTime, nullable=True)
    
    # Results
    last_status = Column(String(20), nullable=True)  # success, failed
    last_error = Column(Text, nullable=True)
    run_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<ScheduledTask(name={self.name}, schedule={self.schedule})>"


class DashboardWidgetDB(Base):
    """Custom dashboard widget configurations"""
    __tablename__ = "dashboard_widgets"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'))
    
    # Widget info
    widget_type = Column(String(50), nullable=False)  # chart, stat, table, etc.
    title = Column(String(200), nullable=False)
    
    # Configuration
    config = Column(JSON, nullable=False)  # Chart config, data source, etc.
    
    # Layout
    position_x = Column(Integer, default=0)
    position_y = Column(Integer, default=0)
    width = Column(Integer, default=4)
    height = Column(Integer, default=3)
    
    # Status
    enabled = Column(Boolean, default=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<DashboardWidget(title={self.title}, type={self.widget_type})>"


def create_admin_tables():
    """Create admin-specific tables"""
    from core.database.db import engine
    Base.metadata.create_all(bind=engine, tables=[
        AlertHistoryDB.__table__,
        BackupLogDB.__table__,
        PerformanceBenchmarkDB.__table__,
        ScheduledTaskDB.__table__,
        DashboardWidgetDB.__table__,
    ])
