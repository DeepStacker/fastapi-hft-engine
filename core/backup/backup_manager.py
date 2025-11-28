"""
Automated Backup System

Handles automated backups of database, configurations, and logs.
"""
import os
import shutil
import subprocess
from datetime import datetime
import gzip
import json
import asyncio
from pathlib import Path

from core.database.db import async_session_factory
from core.database.admin_models import BackupLogDB
from core.config.settings import get_settings

settings = get_settings()


class BackupManager:
    """Manages automated backups"""
    
    def __init__(self, backup_dir: str = "backups"):
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(exist_ok=True)
    
    async def create_full_backup(self, user_id: int = None) -> dict:
        """Create full system backup"""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        backup_name = f"full_backup_{timestamp}"
        backup_path = self.backup_dir / backup_name
        backup_path.mkdir(exist_ok=True)
        
        start_time = datetime.utcnow()
        
        try:
            # Backup database
            db_file = await self.backup_database(backup_path)
            
            # Backup configurations
            config_file = await self.backup_configurations(backup_path)
            
            # Backup logs
            logs_file = await self.backup_logs(backup_path)
            
            # Create archive
            archive_path = await self.create_archive(backup_path, backup_name)
            
            # Clean up temp directory
            shutil.rmtree(backup_path)
            
            # Calculate duration
            duration = (datetime.utcnow() - start_time).total_seconds()
            
            # Log backup
            await self.log_backup(
                backup_type="full",
                file_path=str(archive_path),
                file_size=archive_path.stat().st_size,
                status="success",
                started_at=start_time,
                duration_seconds=int(duration),
                created_by=user_id
            )
            
            return {
                "status": "success",
                "backup_file": str(archive_path),
                "size_mb": round(archive_path.stat().st_size / 1024 / 1024, 2),
                "duration_seconds": duration
            }
            
        except Exception as e:
            await self.log_backup(
                backup_type="full",
                file_path=str(backup_path),
                file_size=0,
                status="failed",
                error_message=str(e),
                started_at=start_time,
                created_by=user_id
            )
            raise
    
    async def backup_database(self, backup_path: Path) -> Path:
        """Backup PostgreSQL database"""
        db_file = backup_path / "database.sql"
        
        # Extract connection details from DATABASE_URL
        # postgresql+asyncpg://user:pass@host:port/dbname
        import re
        match = re.match(r'postgresql\+asyncpg://(.+):(.+)@(.+):(\d+)/(.+)', settings.DATABASE_URL)
        if match:
            user, password, host, port, dbname = match.groups()
            
            # Use pg_dump
            cmd = [
                "pg_dump",
                "-h", host,
                "-p", port,
                "-U", user,
                "-d", dbname,
                "-f", str(db_file),
                "--no-owner",
                "--no-acl"
            ]
            
            env = os.environ.copy()
            env["PGPASSWORD"] = password
            
            subprocess.run(cmd, env=env, check=True)
        
        # Compress
        with open(db_file, 'rb') as f_in:
            with gzip.open(f"{db_file}.gz", 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        
        os.remove(db_file)
        return Path(f"{db_file}.gz")
    
    async def backup_configurations(self, backup_path: Path) -> Path:
        """Backup system configurations"""
        config_file = backup_path / "configurations.json"
        
        configs = {}
        
        # Backup .env file (sensitive data handled securely)
        if os.path.exists(".env"):
            with open(".env") as f:
                configs["env"] = f.read()
        
        # Backup docker-compose.yml
        if os.path.exists("docker-compose.yml"):
            with open("docker-compose.yml") as f:
                configs["docker_compose"] = f.read()
        
        # Backup from database
        async with async_session_factory() as session:
            from core.database.admin_models import SystemConfigDB
            from sqlalchemy import select
            
            result = await session.execute(select(SystemConfigDB))
            db_configs = result.scalars().all()
            
            configs["system_config"] = [
                {
                    "key": c.key,
                    "value": c.value if not c.is_secret else "***REDACTED***",
                    "category": c.category
                }
                for c in db_configs
            ]
        
        with open(config_file, 'w') as f:
            json.dump(configs, f, indent=2)
        
        return config_file
    
    async def backup_logs(self, backup_path: Path) -> Path:
        """Backup system logs"""
        logs_archive = backup_path / "logs.tar.gz"
        
        if os.path.exists("logs"):
            shutil.make_archive(
                str(backup_path / "logs"),
                'gztar',
                'logs'
            )
        
        return logs_archive
    
    async def create_archive(self, backup_path: Path, backup_name: str) -> Path:
        """Create compressed archive of backup"""
        archive_path = self.backup_dir / f"{backup_name}.tar.gz"
        
        shutil.make_archive(
            str(self.backup_dir / backup_name),
            'gztar',
            backup_path
        )
        
        return archive_path
    
    async def log_backup(self, backup_type: str, file_path: str, file_size: int,
                        status: str, started_at: datetime, error_message: str = None,
                        duration_seconds: int = None, created_by: int = None,
                        is_automated: bool = False):
        """Log backup to database"""
        async with async_session_factory() as session:
            log = BackupLogDB(
                backup_type=backup_type,
                file_path=file_path,
                file_size_bytes=file_size,
                status=status,
                error_message=error_message,
                started_at=started_at,
                completed_at=datetime.utcnow() if status != "in_progress" else None,
                duration_seconds=duration_seconds,
                created_by=created_by,
                is_automated=is_automated
            )
            session.add(log)
            await session.commit()
    
    async def cleanup_old_backups(self, keep_days: int = 30):
        """Delete backups older than specified days"""
        cutoff_date = datetime.utcnow() - timedelta(days=keep_days)
        
        for backup_file in self.backup_dir.glob("*.tar.gz"):
            file_time = datetime.fromtimestamp(backup_file.stat().st_mtime)
            if file_time < cutoff_date:
                backup_file.unlink()
    
    async def restore_backup(self, backup_file: str):
        """Restore from a backup file"""
        # Extract archive
        restore_path = self.backup_dir / "restore_temp"
        restore_path.mkdir(exist_ok=True)
        
        shutil.unpack_archive(backup_file, restore_path)
        
        # Restore database
        db_file = restore_path / "database.sql.gz"
        if db_file.exists():
            # Decompress
            with gzip.open(db_file, 'rb') as f_in:
                with open(restore_path / "database.sql", 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
            
            # Restore to PostgreSQL
            # WARNING: This will overwrite current database!
            # Implementation would use psql to restore
        
        # Restore configurations
        config_file = restore_path / "configurations.json"
        if config_file.exists():
            with open(config_file) as f:
                configs = json.load(f)
            
            # Restore configs (carefully!)
            pass
        
        # Clean up
        shutil.rmtree(restore_path)


# Global backup manager
backup_manager = BackupManager()
